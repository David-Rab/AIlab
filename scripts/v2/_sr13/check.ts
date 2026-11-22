// SR-13 targeted check (run alone: npx tsx scripts/v2/_sr13/check.ts): safeguard items on deployments.
//  1. adding a control protocol raises the internal lane's stop rate (one combine rule) and costs the stated Slowdown
//     (the lane's useful work × (1 − slowdown); Greenblatt defer 10% at the full trusted gap = 7%, 20% = 17%);
//  2. a restriction can be added and lifted (Chances × 0.3, then back).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { AGENT_USES } from '../../../src/data/v2/agents';
import { agentSplitShare, monitorVersion, agentVersion } from '../../../src/engine/v2/departments/agents';
import { actTable } from '../../../src/engine/v2/safety/actTable';
import { useControl } from '../../../src/engine/v2/safety/oversight';
import { applyResponse } from '../../../src/engine/v2/safety/responses';
import { CONTROL_SETTINGS, combineStop, controlTerms, isRestricted, setControl } from '../../../src/engine/v2/safety/safeguards';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const f4 = (x: number) => x.toFixed(4);
const load = (fx: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));

check(near(controlTerms('defer10', undefined).slowdown, 1 - CONTROL_SETTINGS.defer10.usefulness) && near(controlTerms('defer20', undefined).slowdown, 0.17), 'Greenblatt slowdowns at the full gap: defer 10% → 7%, 20% → 17%');
function near(a: number, b: number) { return Math.abs(a - b) < 1e-9; }

for (const fx of ['day400.json', 'day900.json']) {
  const s = load(fx);
  check(s.schemaRev === SCHEMA_REV && s.player.deployments.every((d) => Array.isArray(d.guards)), `${fx}: loads at rev ${SCHEMA_REV} with guards on every deployment`);
  const internal = s.player.deployments.filter((d) => d.channel === 'internal' && d.status === 'live');
  const use = AGENT_USES.find((u) => agentSplitShare(s, u) > 0 && !!agentVersion(s, u));
  check(!!use && internal.length > 0, `${fx}: an internal lane runs`);
  if (!use) continue;
  for (const d of internal) setControl(d, false);
  const off = actTable(s, { use }, false)!;
  const uOff = useControl(s, agentVersion(s, use), monitorVersion(s, use));
  for (const d of internal) setControl(d, true, 'defer20');
  const on = actTable(s, { use }, false)!;
  const uOn = useControl(s, agentVersion(s, use), monitorVersion(s, use));
  const row = (t: typeof off, id: string) => t.rows.find((r) => r.id === id)!;
  const ids = off.rows.filter((r) => r.per === 'year' && r.group !== 'misuse').map((r) => r.id);
  const raised = ids.every((id) => row(on, id).stopRate >= row(off, id).stopRate - 1e-12) && ids.some((id) => row(on, id).stopRate > row(off, id).stopRate + 1e-6);
  const r0 = row(on, ids[0]);
  check(raised, `${fx}: control protocol (defer 20%) raises stop rate on ${use}`, `${ids[0]} ${f4(row(off, ids[0]).stopRate)} → ${f4(r0.stopRate)}`);
  const g = on.guards.find((x) => x.kind === 'control');
  check(!!g && near(1 - uOn.usefulness, g.slowdown) && uOff.usefulness === 1 && g.slowdown > 0.03, `${fx}: it costs the stated Slowdown on the lane's useful work`, `slowdown ${f4(g?.slowdown ?? -1)}, gap ${f4(uOn.gapOom)} OOM`);
  const comb = combineStop([on.site.monitor, on.site.human, ...on.guards.map((x) => x.stop)]);
  check(on.guards.some((x) => x.kind === 'review') && comb > 0, `${fx}: guards listed (review, control) and combine by 1 − Π(1 − stop)`, `combined ${f4(comb)}`);

  // 2. Restriction two-way on a live product.
  const p = s.player.deployments.find((d) => d.channel !== 'internal' && d.status === 'live');
  if (!p) { check(true, `${fx}: no live product (restriction part skipped)`); continue; }
  const ch0 = actTable(s, { deploymentId: p.id }, false)!.site.site.scale;
  const e1 = applyResponse(s, makeCtx(s), 'restrictContext', p.versionId);
  const ch1 = actTable(s, { deploymentId: p.id }, false)!.site.site.scale;
  const e2 = applyResponse(s, makeCtx(s), 'liftRestriction', p.versionId);
  const ch2 = actTable(s, { deploymentId: p.id }, false)!.site.site.scale;
  check(!e1 && !e2 && near(ch1, ch0 * 0.3) && near(ch2, ch0) && !isRestricted(p), `${fx}: restriction cuts Chances ×0.3 and can be lifted`, `${f4(ch0)} → ${f4(ch1)} → ${f4(ch2)}`);
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
