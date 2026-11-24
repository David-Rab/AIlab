// RD-A05a targeted check: the flat allocation sums to 1; readers read it. (CP4: the rev-51 migration part is gone with
// the UB-3 save break.) Run alone: npx tsx scripts/v2/_a05a/check.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { presetSplit, SPLIT_KEYS, SPLIT_PRESETS, playerShareRef } from '../../../src/engine/v2/departments/split';
import { AGENT_LINE, agentSplitShare } from '../../../src/engine/v2/departments/agents';
import { poolsOf } from '../../../src/engine/v2/compute/power';
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

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
