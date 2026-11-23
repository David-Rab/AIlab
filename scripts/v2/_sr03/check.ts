// SR-03 targeted check: the believed act table reproduces dangerView's numbers from before the refactor (baseline.json,
// written by baseline.ts on the pre-SR-03 tree), and the engine table reproduces incidents' attempt rates (dangerOf per
// fleet, exfiltrationHazard, misuseHazards). Run alone: npx tsx scripts/v2/_sr03/check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { actTable } from '../../../src/engine/v2/safety/actTable';
import { dangerView, type DangerRead } from '../../../src/engine/v2/safety/dangerView';
import { dangerOf, exfiltrationHazard, forEachIncidentSite, misuseHazards } from '../../../src/engine/v2/safety/incidents';
import { FIXTURE_DIR, HERE } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1e-30, Math.abs(a), Math.abs(b));
const base = JSON.parse(readFileSync(join(HERE, '_sr03', 'baseline.json'), 'utf8')) as Record<string, ReturnType<typeof dangerView>>;

for (const fx of ['day400.json', 'day900.json']) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));
  // 1. dangerView now reads the table; it equals the pre-refactor numbers exactly.
  const now = dangerView(s);
  check(JSON.stringify(now) === JSON.stringify(base[fx]), `${fx}: dangerView identical to the pre-SR-03 baseline`);
  // 2. The believed table's trait rows equal the old readout's acts.
  const same = (r: DangerRead | undefined, rows: ReturnType<typeof actTable>) => !!r && !!rows && r.acts.every((a) => {
    const t = rows.rows.find((x) => x.id === a.trait);
    return !!t && t.attempts === a.attempts && t.unstopped === a.harmful && t.wouldTry === a.disposition && t.ableTo === a.capability && t.chances === a.opportunity && t.stopRate === a.oversight;
  });
  const old = base[fx];
  let ok = true;
  for (const [id, r] of Object.entries(old.products)) ok &&= same(r, actTable(s, { deploymentId: id }, true));
  for (const [u, r] of Object.entries(old.lanes)) ok &&= same(r, actTable(s, { use: u as never }, true));
  check(ok, `${fx}: believed table trait rows = the baseline's acts (every product and lane)`);
  // 3. The engine table equals incidents' attempt rates per site (dangerOf; misuse).
  let n = 0;
  let bad = 0;
  forEachIncidentSite(s, (d, v, usage) => {
    const tab = actTable(s, d.channel === 'internal' ? { deploymentId: d.id, versionId: v.id, usage } : { deploymentId: d.id }, false);
    for (const r of dangerOf(s, d, v, usage)) {
      if (r.source === 'misuse' || r.source.startsWith('U')) continue;
      const t = tab?.rows.find((x) => x.id === r.source);
      n++;
      if (!t || !close(t.attempts, r.attempts * 365) || !close(t.unstopped, r.rate * 365)) bad++;
    }
    for (const m of misuseHazards(s, v, d)) {
      const t = tab?.rows.find((x) => x.id === (m.domain === 'BIO' ? 'MISUSE_BIO' : 'MISUSE_CYBER'));
      n++;
      if (!t || !close(t.unstopped, m.h * 365)) bad++;
    }
  });
  check(n > 0 && bad === 0, `${fx}: engine table = incidents' attempt and harmful rates (trait acts, misuse)`, `${n} rows, ${bad} off`);
  // 4. Exfiltration row = exfiltrationHazard on the internal model's fleet.
  const v = internalVersion(s);
  const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status !== 'withdrawn');
  const tab = v && d ? actTable(s, { deploymentId: d.id, versionId: v.id, usage: 1 }, false) : undefined;
  const ex = tab?.rows.find((r) => r.id === 'EXFIL');
  check(!!ex && close(ex.unstopped, exfiltrationHazard(s) * 365), `${fx}: "Copies itself out" = exfiltrationHazard × 365`, ex ? `${ex.unstopped.toExponential(3)}` : '');
  // 5. Shape: three groups, the composite row, ranges contain the estimate.
  const bt = v && d ? actTable(s, { deploymentId: d.id, versionId: v.id, usage: 1 }, true) : undefined;
  const groups = new Set(bt?.rows.map((r) => r.group));
  const prod = s.player.deployments.find((x) => x.channel !== 'internal' && x.status !== 'withdrawn');
  const pt = prod ? actTable(s, { deploymentId: prod.id }, true) : undefined;
  for (const r of pt?.rows ?? []) groups.add(r.group);
  check(groups.size === 3 && !!bt?.rows.find((r) => r.id === 'TAKEOVER') && (bt?.rows ?? []).every((r) => r.wouldTryLo <= r.wouldTry + 1e-12 && r.wouldTry <= r.wouldTryHi + 1e-12),
    `${fx}: three groups, the "Acts against the lab" row, Would try inside its range`, (bt?.rows ?? []).map((r) => `${r.id} ${r.unstopped.toPrecision(2)}`).join(' '));
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
