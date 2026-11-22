// RD-A05a targeted check: the flat allocation sums to 1; readers read it; a rev-51 (nested) save migrates to the same
// compute per use. Run alone: npx tsx scripts/v2/_a05a/check.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../../../src/engine/v2/core/save';
import { presetSplit, SPLIT_KEYS, SPLIT_PRESETS, playerShareRef } from '../../../src/engine/v2/departments/split';
import { AGENT_LINE, agentSplitShare, monitorBudget, monitorCostRatio, safetyPoolClaims } from '../../../src/engine/v2/departments/agents';
import { poolsOf } from '../../../src/engine/v2/compute/power';
import { linePoolH100e } from '../../../src/engine/v2/safety/lineProjects';
import { AGENT_USES } from '../../../src/data/v2/agents';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const sum = (sp: Record<string, number>) => SPLIT_KEYS.reduce((a, k) => a + sp[k], 0);
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(near(sum(s.player.split), 1, 1e-9), 'player allocation sums to 1 (idle included)', sum(s.player.split).toFixed(12));
for (const r of s.rivals) check(near(sum(r.core.split), 1, 1e-9), `${r.core.id} allocation sums to 1`);
for (const p of SPLIT_PRESETS) check(near(sum(presetSplit(p, 2027, s.player.split)), 1, 1e-9), `preset ${p} sums to 1`);
check(near(sum(playerShareRef(2025.5)), 1, 1e-9), 'reference allocation sums to 1');
const pools = poolsOf(s);
check(SPLIT_KEYS.every((k) => near(pools[k], s.player.computeOnline * s.player.split[k])), 'poolsOf = online × the flat allocation');
check(AGENT_USES.every((u) => agentSplitShare(s, u) === s.player.split[AGENT_LINE[u]]), 'every agent use reads its own line');
// No reader of the nested shapes left in src.
const bad: string[] = [];
const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !p.endsWith('save.ts')) { // save.ts: the migration reads the old shapes
  const t = readFileSync(p, 'utf8');
  if (/split\.agents\b|\.agents\.\w+\.compute\b|policies\.monitorBudget|monitors\.poolShare|safetyAgentShare/.test(t)) bad.push(p);
} } };
walk('src');
check(bad.length === 0, 'no reader of the nested split in src', bad.join(', '));

// Migration: rebuild a rev-51 nested save from the flat state, with a budget above the monitors' need and an open case.
const cur = JSON.parse(serialize(s));
const sp = cur.player.split;
const ps = sp.safety + sp.monitors + sp.safetyAgents;
const ag = sp.routine + sp.frontier;
const A = 0.1; // safety agents: 10% of the old pool
const B = 0.5; // monitoring budget: 50% of the old pool
const inv0 = 0.05;
const old = { ...cur, schemaRev: 51 };
old.player.split = { training: sp.training, synthetic: sp.synthetic, experiments: sp.experiments, serving: sp.serving, engineering: sp.engineering, agents: ag, safety: ps };
old.player.agents.eng.compute = 1;
old.player.agents.capRoutine.compute = sp.routine / ag;
old.player.agents.capFrontier.compute = sp.frontier / ag;
old.player.agents.safety.compute = A;
old.player.policies.monitorBudget = B;
const v = cur.player.models.versions[0];
old.player.safety.investigations.push({ id: 'INVA05', target: { kind: 'trait', versionId: v.id, trait: 'SCHEME' }, fte: 10, computeShare: inv0, tools: [], startDay: cur.time.day, clarity: 0 });
const m = deserialize(JSON.stringify(old));
const on = m.player.computeOnline;
// Old effective compute per use (RD-B07's rules; fast path: B·ps covers the need here, budget + cases + agents ≤ 1).
let need = 0;
const oldShare: Record<string, number> = { eng: sp.engineering, capRoutine: sp.routine, capFrontier: sp.frontier, safety: ps * A };
for (const u of AGENT_USES) need += monitorCostRatio(m, u) * oldShare[u];
const oldMon = Math.min(B * ps, need);
const oldInv = ps * inv0;
const oldLines = ps * (1 - oldMon / ps - inv0 - A);
check(B + inv0 + A <= 1 && near(sum(m.player.split), 1, 1e-9), 'migrated allocation sums to 1');
for (const u of AGENT_USES) check(near(agentSplitShare(m, u) * on, oldShare[u] * on), `migrated ${u}: same compute`, `${(agentSplitShare(m, u) * on).toFixed(1)} vs ${(oldShare[u] * on).toFixed(1)}`);
const mb = monitorBudget(m);
check(near(mb.used * on, oldMon * on) && near(mb.coverage, Math.min(1, (B * ps) / Math.max(1e-12, need))), 'migrated monitors: same compute and coverage', `${(mb.used * on).toFixed(1)} vs ${(oldMon * on).toFixed(1)}`);
const c = safetyPoolClaims(m);
const invNow = m.player.safety.investigations.find((i) => i.id === 'INVA05')!;
check(near(invNow.computeShare * c.invScale * m.player.split.safety * on, oldInv * on), 'migrated case: same compute');
check(near(linePoolH100e(m), oldLines * on, 1e-6), 'migrated safety research lines: same compute', `${linePoolH100e(m).toFixed(1)} vs ${(oldLines * on).toFixed(1)}`);
for (const k of ['training', 'synthetic', 'experiments', 'serving', 'engineering'] as const) check(near(m.player.split[k], sp[k]), `migrated ${k}: same share`);
check(m.rivals.every((r) => near(sum(r.core.split), 1, 1e-9)), 'migrated rivals sum to 1');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
