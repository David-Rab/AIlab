// MK-2 targeted check (design/MARKET.md M10): on the designer's day-369 save (read-only), a Vetted product gets the
// safety framework's package and safeguards exactly as an Enterprise product with the same model (no Trusted-style
// exemption), it shows in the product guard rows, it is held like one, commitments count it as an external
// deployment, and the usage terms (no surveillance, no autonomous weapons) gate Vetted launches as they gated
// Government's.
// Run alone: npx tsx scripts/v2/_mk2/check.ts
import { existsSync, readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { frameworkDeployBlock, frameworkOf, requiredSafeguards, ruleTriggered } from '../../../src/engine/v2/safety/framework';
import { frameworkCandidate, frameworkSystem, packageMeets, withFrameworkParts } from '../../../src/engine/v2/safety/packages';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { productGuardRows } from '../../../src/engine/v2/safety/readoutsSafeguards';
import { DEPLOY_SCOPE, PREDICATES, committedUsagePolicy, deployClause } from '../../../src/engine/v2/actors/commitments';
import { deployGate } from '../../../src/engine/v2/models/deployments';
import type { Commitment, Deployment } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const PATH = 'C:/Users/david/Downloads/ai27-v2-day369.json';
if (!existsSync(PATH)) { console.log(`FAIL ${PATH} missing`); process.exit(1); }
const load = () => deserialize(readFileSync(PATH, 'utf8'));

const s0 = load();
console.log(`day ${s0.time.day}; products:`);
for (const d of s0.player.deployments) if (d.status !== 'withdrawn') console.log(`  ${d.id.padEnd(6)} ${d.channel.padEnd(10)} ${d.status.padEnd(9)} ${s0.player.models.versions.find((v) => v.id === d.versionId)?.name ?? d.versionId}`);
const ent0 = s0.player.deployments.find((d) => d.channel === 'enterprise' && d.status === 'live');
if (!ent0) { console.log('FAIL no live Enterprise product in the save'); process.exit(1); }
const v = s0.player.models.versions.find((x) => x.id === ent0.versionId)!;
const fw = frameworkOf(s0);
const trig = fw.rules.filter((r) => r.holds === 'deploy' && ruleTriggered(s0.hidden.timeline, r, v));
console.log(`\nmodel ${v.name}; framework deploy rules it triggers: ${trig.map((r) => r.label).join('; ') || 'none'}`);

/** A Vetted product that is the Enterprise product moved to Vetted (same model, lineup, guards, record). */
const vettedOf = (e: Deployment): Deployment => ({ ...structuredClone(e), id: `${e.id}v`, channel: 'vetted' });
const show = (d: Deployment) => `safeguards ${d.safeguards}; guards ${(d.guards ?? []).map((g) => g.kind).sort().join(', ') || 'none'}`;

// 1. Launch candidate: the package the framework adds on a fresh launch of the same model.
const fresh = { safeguards: 'minimal' as const, guards: [] };
const cE = frameworkCandidate(s0, v, 'enterprise', fresh);
const cV = frameworkCandidate(s0, v, 'vetted', fresh);
const fmtC = (c: typeof cE) => `parts [${c.parts.join(', ')}]; safeguards ${c.safeguards}; guards ${(c.guards ?? []).map((g) => g.kind).sort().join(', ') || 'none'}`;
console.log(`\nlaunch package, Enterprise: ${fmtC(cE)}`);
console.log(`launch package, Vetted:     ${fmtC(cV)}`);
check(JSON.stringify(cE) === JSON.stringify(cV), 'a Vetted launch gets the same framework package as an Enterprise launch');
if (trig.length) check(cV.parts.length > 0, 'the Vetted package is not empty (the model triggers a deploy rule)');

// 2. Required safeguards of the live product and of its Vetted twin.
const vet0 = vettedOf(ent0);
const rE = [...requiredSafeguards(s0, ent0)].sort();
const rV = [...requiredSafeguards(s0, vet0)].sort();
console.log(`\nrequired safeguards, Enterprise ${ent0.id}: ${rE.join(', ') || 'none'}`);
console.log(`required safeguards, Vetted twin:     ${rV.join(', ') || 'none'}`);
check(rE.join() === rV.join(), 'requiredSafeguards: Vetted asks what Enterprise asks');
check(packageMeets(s0, ent0) === packageMeets(s0, vet0), 'packageMeets reads the same', `${packageMeets(s0, ent0)} | ${packageMeets(s0, vet0)}`);
// The save's own Vetted product (MK-1 migrated it from Government / Trusted) on the same model as Enterprise.
const own = s0.player.deployments.find((d) => d.channel === 'vetted' && d.status === 'live' && d.versionId === ent0.versionId);
if (own) {
  const rO = [...requiredSafeguards(s0, own)].sort();
  console.log(`required safeguards, the save's Vetted ${own.id}: ${rO.join(', ') || 'none'}; ${show(own)}; Enterprise ${ent0.id}: ${show(ent0)}`);
  check(rO.join() === rE.join(), "the save's Vetted product is asked what its Enterprise product is asked");
}

// 3. Edit preview (withFrameworkParts) on an un-packaged copy: both get the same parts.
const bare = (d: Deployment): Deployment => ({ ...structuredClone(d), safeguards: 'minimal', guards: [], frameworkApplied: [] });
const nE = bare(ent0); const nV = bare(vet0);
const pE = withFrameworkParts(s0, nE); const pV = withFrameworkParts(s0, nV);
console.log(`\nedit preview from bare, Enterprise: [${pE.join(', ')}] → ${show(nE)}`);
console.log(`edit preview from bare, Vetted:     [${pV.join(', ')}] → ${show(nV)}`);
check(pE.join() === pV.join() && show(nE) === show(nV), 'withFrameworkParts: same parts on Vetted as on Enterprise');

// 4. The daily framework system on a bare Vetted twin in the state: the package is applied, the product is held as one.
{
  const s = load();
  const e = s.player.deployments.find((d) => d.id === ent0.id)!;
  const vt = bare(vettedOf(e));
  const eb = bare(e);
  Object.assign(e, { safeguards: eb.safeguards, guards: eb.guards, frameworkApplied: eb.frameworkApplied });
  s.player.deployments.push(vt);
  const before = withFrameworkParts(s, structuredClone(vt)).length;
  frameworkSystem.run(s, makeCtx(s));
  console.log(`\nframework system, Enterprise ${e.id}: ${show(e)}; applied ${(e.frameworkApplied ?? []).length} part(s)`);
  console.log(`framework system, Vetted ${vt.id}:  ${show(vt)}; applied ${(vt.frameworkApplied ?? []).length} part(s) (${before} pending before)`);
  check(show(e) === show(vt), 'frameworkSystem applies the package to Vetted as to Enterprise');
  const rows = productGuardRows(s);
  check(rows.some((r) => r.ids.includes(vt.id)), 'productGuardRows lists the Vetted product', rows.map((r) => r.names.join('+')).join(' | '));
  const hb = frameworkDeployBlock(s, v, 'vetted', { safeguards: 'minimal', guards: [] });
  const he = frameworkDeployBlock(s, v, 'enterprise', { safeguards: 'minimal', guards: [] });
  console.log(`deploy block with minimal safeguards, Enterprise: ${he ?? 'none'}`);
  console.log(`deploy block with minimal safeguards, Vetted:     ${hb ?? 'none'}`);
  check(he === hb, 'frameworkDeployBlock: Vetted is held like Enterprise');
}

// 5. Commitments: Vetted counts as an external deployment.
{
  const s = load();
  const c: Commitment = { id: 'Cmk2', kind: 'testingAgreement', title: 'MK-2 test', condition: { predicate: 'preDeployTesting', params: { days: 100000 } }, signedDay: -1, status: 'live', amendments: 0 };
  const cand = (channel: string) => ({ versionId: v.id, channel, safeguards: 'classifiers', usagePolicy: { noSurveillance: true, noAutonomousWeapons: true } });
  for (const ch of ['enterprise', 'vetted', 'internal']) console.log(`  preDeployTesting on ${ch.padEnd(10)}: scope ${DEPLOY_SCOPE.preDeployTesting(ch)}; clause ${deployClause(s, c, cand(ch)) ?? 'none'}; gate predicate ${PREDICATES.preDeployTesting(s, { days: 100000, versionId: v.id, channel: ch }, c)}`);
  check(DEPLOY_SCOPE.preDeployTesting('vetted') && !!deployClause(s, c, cand('vetted')), 'pre-deployment testing binds a Vetted launch (external)');
  check(PREDICATES.preDeployTesting(s, { days: 100000, versionId: v.id, channel: 'vetted' }, c), 'the preDeployTesting gate predicate counts Vetted as external');
  check(!DEPLOY_SCOPE.preDeployTesting('internal'), 'internal use stays outside it');
  s.player.deployments.push({ ...vettedOf(s.player.deployments.find((d) => d.id === ent0.id)!), versionSince: s.time.day, startDay: s.time.day });
  for (const d of s.player.deployments) if (d.channel !== 'vetted' && d.channel !== 'internal') d.status = 'withdrawn';
  check(PREDICATES.preDeployTesting(s, { days: 100000 }, c), 'the standing preDeployTesting check binds on a live Vetted product alone');
  check(DEPLOY_SCOPE.monitorabilityPledge('vetted'), 'the monitorability pledge covers Vetted');
}

// 6. Usage terms are Vetted's: they gate Vetted launches, not Enterprise ones.
{
  const s = load();
  const c: Commitment = { id: 'Cmk2u', kind: 'usageRestriction', title: 'No mass surveillance or autonomous weapons', condition: { predicate: 'noSurveillance', params: {} }, signedDay: s.time.day, status: 'live', amendments: 0 };
  s.commitments.push(c);
  const none = { noSurveillance: false, noAutonomousWeapons: false };
  const clV = deployClause(s, c, { versionId: v.id, channel: 'vetted', safeguards: 'classifiers', usagePolicy: none });
  const clE = deployClause(s, c, { versionId: v.id, channel: 'enterprise', safeguards: 'classifiers', usagePolicy: none });
  console.log(`\nusage terms: Vetted launch without them: ${clV ?? 'none'}; Enterprise: ${clE ?? 'none'}`);
  check(!!clV && !clE, 'the no-surveillance commitment blocks a Vetted launch without the term, not an Enterprise one');
  const up = committedUsagePolicy(s, 'vetted');
  check(up.noSurveillance && up.noAutonomousWeapons, 'a new Vetted product starts with both terms under the commitment', JSON.stringify(up));
  check(!committedUsagePolicy(s, 'enterprise').noSurveillance, 'an Enterprise product does not');
  const g = deployGate(s, v, 'vetted', { usagePolicy: { noDropInReplacement: false, ...none, minorsProtections: false } });
  check(g !== true && String(g).includes('No mass surveillance'), 'deployGate refuses the Vetted launch without the terms', String(g));
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
