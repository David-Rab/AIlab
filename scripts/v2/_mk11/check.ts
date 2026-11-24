// MK-11 targeted check (design/MARKET.md M9, M14): the day-369 save (read-only) through the 105 → 106 migration:
//  1. built features and each product's features / adaptations → tools and certifications (printed before → after);
//  2. agent-hours only on a product carrying Agent mode, and > 0 there when its model passes the gate;
//  3. certification acts through a harness (switching the harness off removes the friction cut; a harness switched on
//     starts a certification);
//  4. revenue on load and with Agent mode on every product that can carry it (the before figure is the pre-MK-11
//     engine's, from scripts/v2/_mk11/rev.ts run in a checkout of the base commit; see the MK-11 report).
// Run alone: npx tsx scripts/v2/_mk11/check.ts [save.json]
import { existsSync, readFileSync } from 'node:fs';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { tick } from '../../../src/engine/v2/core/loop';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { frictionOf } from '../../../src/engine/v2/worldfx/sectors';
import { policyState } from '../../../src/engine/v2/worldfx/policy';
import { SECTOR_BY_ID } from '../../../src/data/v2/sectors';
import { agentsGate, measuredHorizonH } from '../../../src/engine/v2/models/products';
import { certifiedBuyerShare, certifiedHere } from '../../../src/engine/v2/models/certs';
import { CERT_DAYS, CERT_FRICTION_CUT, PRODUCT_TOOL_BY_ID, TOOL_FROM_FEATURE, harnessForAdaptation, type ProductToolId } from '../../../src/data/v2/tools';
import type { FeatureId } from '../../../src/data/v2/features';
import type { Deployment, GameStateV2, SectorId } from '../../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const path = process.argv[2] ?? 'C:/Users/david/Downloads/ai27-v2-day369.json';
if (!existsSync(path)) { console.log(`no save at ${path}`); process.exit(1); }
const json = readFileSync(path, 'utf8');
const clone = (g: GameStateV2) => structuredClone(g);
const tn = (id: string) => PRODUCT_TOOL_BY_ID[id as ProductToolId]?.name ?? id;

// ───────── 1. migration ─────────
type RawDep = { id: string; channel: string; status: string; features?: string[]; adaptations?: { sector: string; certDone?: number }[] };
const raw = JSON.parse(json) as { schemaRev: number; player: { features: string[]; deployments: RawDep[] }; rivals: { core: { id: string }; tools?: string[] }[] };
const s = deserialize(json);
console.log(`${path}: day ${s.time.day}, schemaRev ${raw.schemaRev} → ${s.schemaRev}`);
check(s.schemaRev === SCHEMA_REV, `migrated to schemaRev ${SCHEMA_REV}`);
console.log(`\nBuilt: ${raw.player.features.join(', ')}\n    → ${s.player.features.map(tn).join(', ')}`);
check(raw.player.features.every((f) => s.player.features.includes(TOOL_FROM_FEATURE[f as FeatureId])), 'every built feature is a built tool (TOOL_FROM_FEATURE)');
console.log('\nPer product (before: channel, features, adaptations → after: channel, tools, certifications):');
const CH1: Record<string, string> = { gov: 'vetted', trusted: 'vetted', agents: 'api' };
let mapOk = true;
for (const b of raw.player.deployments) {
  const d = s.player.deployments.find((x) => x.id === b.id)!;
  const ad = (b.adaptations ?? []).map((a) => `${a.sector}${a.certDone !== undefined ? `@${a.certDone}` : ''}`).join(' ') || '-';
  console.log(`  ${b.id} ${b.channel}/${b.status}: [${(b.features ?? []).join(', ')}] adapt ${ad}`);
  console.log(`     → ${d.channel}: [${d.features.map(tn).join(', ')}] certs ${(d.certs ?? []).map((c) => `${c.sector}@${c.certDone}`).join(' ') || '-'}`);
  const ch = CH1[b.channel] ?? b.channel;
  for (const f of b.features ?? []) {
    const t = TOOL_FROM_FEATURE[f as FeatureId];
    const offered = (PRODUCT_TOOL_BY_ID[t].products as string[]).includes(ch);
    if (offered !== d.features.includes(t)) mapOk = false;
    if (!offered) console.log(`       dropped: ${tn(t)} (not offered on ${ch})`);
  }
  for (const a of b.adaptations ?? []) {
    const h = harnessForAdaptation(a.sector as SectorId, ch as Deployment['channel']);
    if (!h) { console.log(`       dropped: ${a.sector} adaptation (no harness on ${ch} covers it)`); continue; }
    if (!d.features.includes(h)) mapOk = false;
    if (a.certDone !== undefined && !(d.certs ?? []).some((c) => c.sector === a.sector && c.certDone === a.certDone)) mapOk = false;
    console.log(`       ${a.sector} adaptation → ${tn(h)}${a.certDone !== undefined ? `, certification kept (${a.certDone})` : ''}`);
  }
  if (b.channel === 'agents' && !d.features.includes('agentMode')) mapOk = false;
}
check(mapOk, 'features → tools (Voice & vision off the business products), adaptations → harnesses with their certification, Agents → Agent mode');
check(!raw.player.deployments.some((b) => b.channel === 'agents') || s.player.features.includes('agentMode'), 'a former Agents product makes Agent mode built');
check(s.player.deployments.filter((d) => ['api', 'enterprise', 'vetted'].includes(d.channel) && d.status !== 'withdrawn').every((d) => d.features.includes('agentMode')),
  'every live API / Enterprise / Vetted product gets Agent mode (lead decision: keep the save\'s income)');
for (const r of s.rivals) console.log(`  rival ${r.core.id} (${r.archetype}): ${(raw.rivals.find((x) => x.core.id === r.core.id)?.tools ?? []).join(', ') || '-'} → ${(r.tools ?? []).join(', ') || '-'}`);
console.log(`  China: ${(s.china.lab.tools ?? []).join(', ') || '-'}; toolShip ${JSON.stringify(s.world.fx.toolShip ?? {})}`);

// ───────── 2. agent-hours only with Agent mode ─────────
const agH = (g: GameStateV2, id: string) => revenueReadout(g).deps.find((x) => x.id === id)?.agentHours ?? 0;
const live = s.player.deployments.filter((d) => d.kind === 'product' && d.status !== 'withdrawn' && d.channel !== 'consumer');
console.log('\nAgent-hours by live business product (as migrated):');
for (const d of live) console.log(`  ${d.id} ${d.channel}: Agent mode ${d.features.includes('agentMode') ? 'on' : 'off'}, model h50 ${measuredHorizonH(s.player.models.versions.find((v) => v.id === d.versionId))?.toFixed(1) ?? '?'} h, agent-hours ${agH(s, d.id).toExponential(2)}`);
{
  const off = clone(s);
  for (const d of off.player.deployments) d.features = d.features.filter((t) => t !== 'agentMode');
  check(live.every((d) => agH(off, d.id) === 0), 'a product without Agent mode sells 0 agent-hours (Agent mode switched off on a copy)', live.map((d) => `${d.id} ${agH(off, d.id)}`).join(', '));
  console.log(`  revenue on load with Agent mode off everywhere: $${revenueReadout(off).total.toFixed(2)}B/yr`);
}
{
  const g = clone(s);
  if (!g.player.features.includes('agentMode')) g.player.features.push('agentMode');
  const pass = live.filter((d) => agentsGate(g.player.models.versions.find((v) => v.id === d.versionId)) === true);
  for (const d of g.player.deployments) if (live.some((x) => x.id === d.id) && !d.features.includes('agentMode')) d.features.push('agentMode');
  for (const d of live) {
    const v = g.player.models.versions.find((x) => x.id === d.versionId);
    console.log(`  with Agent mode on ${d.id} ${d.channel}: gate ${agentsGate(v) === true ? 'passes' : agentsGate(v)}; agent-hours ${agH(g, d.id).toExponential(2)}`);
  }
  check(pass.length > 0 && pass.every((d) => agH(g, d.id) > 0), 'with Agent mode on, a product whose model passes the gate sells agent-hours', pass.map((d) => d.id).join(', '));
  // A model that fails the gate (its measured horizon set below 4 h on a copy) sells none.
  const h = clone(g);
  const d0 = pass[0];
  if (d0) {
    const v = h.player.models.versions.find((x) => x.id === d0.versionId)!;
    v.evals.bench.horizon = { score: 60, sd: 0, day: 0, by: 'self' };
    check(agH(h, d0.id) === 0, 'the same product with a model short of the gate sells 0 agent-hours', `${d0.id}: ${agentsGate(v)}`);
  }
  const r0 = revenueReadout(s).total, r1 = revenueReadout(g).total;
  console.log(`\nRevenue on load: as migrated $${r0.toFixed(2)}B/yr (Agent mode on every live business product: $${r1.toFixed(2)}B/yr)`);
}

// ───────── 3. certification through a harness ─────────
{
  const g = clone(s);
  const ent = g.player.deployments.find((d) => d.channel === 'enterprise' && d.status !== 'withdrawn');
  if (!ent) check(false, 'a live Enterprise product');
  else {
    // Jump past every certification's end, so the migrated FIN / HEALTH / GOV records are done.
    const done = Math.max(...(ent.certs ?? []).map((c) => c.certDone), g.time.day);
    const atDay = (x: GameStateV2) => { x.time.day = done; return x; };
    const a = atDay(clone(g));
    const fr = (x: GameStateV2, sid: SectorId) => {
      const mix = worldMix(x);
      const m = mix.sec.US[sid];
      const share = certifiedBuyerShare(x, sid, m.playerProdW);
      return { share, R: frictionOf(x, 'US', SECTOR_BY_ID[sid], policyState(x), share * (m.share[mix.providers.findIndex((p) => p.key === 'player')] ?? 0)) };
    };
    const ae = a.player.deployments.find((d) => d.id === ent.id)!;
    const certSecs = (ae.certs ?? []).map((c) => c.sector);
    console.log(`\nCertifications on ${ent.id} (day ${done}): ${certSecs.map((x) => `${x} ${certifiedHere(a, ae, x) ? 'certified' : 'not acting'}`).join(', ')}`);
    const sid = certSecs.find((x) => certifiedHere(a, ae, x));
    if (!sid) check(false, 'a migrated certification acts through its harness');
    else {
      const on = fr(a, sid);
      const harness = ae.features.filter((t) => (PRODUCT_TOOL_BY_ID[t as ProductToolId]?.sectors as string[] | undefined)?.includes(sid) && PRODUCT_TOOL_BY_ID[t as ProductToolId].kind === 'harness');
      const b = clone(a);
      const be = b.player.deployments.find((d) => d.id === ent.id)!;
      be.features = be.features.filter((t) => !harness.includes(t));
      const off = fr(b, sid);
      check(certifiedHere(a, ae, sid) && !certifiedHere(b, be, sid) && on.share > 0 && off.share === 0 && off.R >= on.R,
        `certification acts through the harness: ${sid} certified with ${harness.map(tn).join(' + ')} on, not with it off (friction cut ${CERT_FRICTION_CUT} × buyers' share)`,
        `buyers' share ${on.share.toFixed(3)} → ${off.share.toFixed(3)}, US friction ${on.R.toFixed(4)} (on) vs ${off.R.toFixed(4)} (off)`);
    }
    // A harness switched on starts a certification the next day (Defence suite on the Vetted product: Military).
    const v = clone(g);
    const vd = v.player.deployments.find((d) => d.channel === 'vetted' && d.status !== 'withdrawn');
    if (vd) {
      if (!v.player.features.includes('defence')) v.player.features.push('defence');
      vd.features = [...vd.features, 'defence'];
      const had = (vd.certs ?? []).some((c) => c.sector === 'MIL');
      tick(v);
      const mil = (vd.certs ?? []).find((c) => c.sector === 'MIL');
      check(!had && !!mil && Math.abs(mil.certDone - (v.time.day + CERT_DAYS)) <= 1, 'Defence & intelligence suite on Vetted starts its Military certification (CERT_DAYS)', JSON.stringify(vd.certs));
    }
  }
}

// ───────── 4. the save still ticks ─────────
{
  const g = clone(s);
  let err = '';
  try { for (let i = 0; i < 3; i++) tick(g); } catch (e) { err = String((e as Error)?.stack ?? e); }
  check(!err, 'the migrated save ticks 3 days', err.split('\n').slice(0, 3).join(' | '));
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
