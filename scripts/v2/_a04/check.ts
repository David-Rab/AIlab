// RD-A04 targeted check: the safety research engineers are split by ONE allocate() over a needs list in the player's
// order (research.safRe); each need takes at most its demand; the rest is idle; SAF_EXP_SHARE is gone.
// Run alone: npx tsx scripts/v2/_a04/check.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { act } from '../../../src/engine/v2/core/loop';
import { casesServed, resetSafAllocation, safAllocation } from '../../../src/engine/v2/safety/lineProjects';
import { safReAllocView } from '../../../src/engine/v2/models/researchView';
import * as AG from '../../../src/data/v2/agendas';
import { DEFAULT_SAF_RE_ALLOC } from '../../../src/data/v2/research';
import type { Investigation, SafReNeed } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const NEEDS: SafReNeed[] = ['cases', 'patches', 'safExp', 'reval'];

const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV >= 56, 'schema 56; an older save migrates');
check(s.player.research.safRe?.order.join(',') === DEFAULT_SAF_RE_ALLOC.order.join(',') && DEFAULT_SAF_RE_ALLOC.order.join(',') === 'cases,patches,safExp,reval',
  'migrated save has the default order (cases, patches, line experiments, re-validation)');

// Demands on every need but re-validation: one open case of 40, a patch (PATCH_FTE 10), the fixture's line experiments.
s.player.safety.investigations.push({ id: 'rda04', fte: 40, computeShare: 0 } as unknown as Investigation);
s.flags['ws2.patchUntil'] = s.time.day + 30;
const safRe = s.player.teams.filter((t) => t.role === 're' && t.dept === 'saf');
resetSafAllocation(s);
const h0 = safAllocation(s).heads;
for (const t of safRe) t.heads *= 60 / h0; // 60 people (heads × quality)
resetSafAllocation(s);
const a = safAllocation(s);
const d = a.demand;
console.log(`  heads ${a.heads.toFixed(1)} · demand ${NEEDS.map((k) => `${k} ${d[k].toFixed(1)}`).join(', ')}`);
check(near(a.heads, 60) && d.cases === 40 && d.patches === 10 && d.safExp > 20, 'demands: cases 40, patches 10, experiments > 20', `exp ${d.safExp.toFixed(1)}`);

const served = (order: SafReNeed[]) => {
  let left = 60;
  const out = {} as Record<SafReNeed, number>;
  for (const k of order) { out[k] = Math.min(left, d[k]); left -= out[k]; }
  return out;
};
const same = (got: Record<SafReNeed, number>, want: Record<SafReNeed, number>) => NEEDS.every((k) => near(got[k], want[k]));
check(same(a.got, served(DEFAULT_SAF_RE_ALLOC.order)), 'default order: served down the list, each at most its demand',
  NEEDS.map((k) => `${k} ${a.got[k].toFixed(1)}`).join(', '));
const expDefault = a.exp;

// The player reorders: line experiments first.
act(s, 'research.safReAlloc', { order: 'safExp,cases,patches,reval' });
const b = safAllocation(s);
check(s.player.research.safRe.order.join(',') === 'safExp,cases,patches,reval', 'the action stores the order');
check(same(b.got, served(['safExp', 'cases', 'patches', 'reval'])), 'served amounts follow the new order',
  NEEDS.map((k) => `${k} ${b.got[k].toFixed(1)}`).join(', '));
check(b.exp > expDefault + 1e-6 && near(b.exp, d.safExp), 'experiments now fully served (their projects get the engineers)', `${expDefault.toFixed(1)} → ${b.exp.toFixed(1)}`);
let perProj = 0;
for (const x of b.re.values()) perProj += x;
check(near(perProj, b.got.safExp), 'per-project engineers sum to the experiments need served');
check(near(casesServed(s), b.got.cases / 40) && casesServed(s) < 1, 'an under-served case runs at the share served', casesServed(s).toFixed(3));
const v = safReAllocView(s);
check(v.order.join(',') === 'safExp,cases,patches,reval' && v.needs.every((n) => near(n.got, b.got[n.k])), 'LAB view lists the needs in the player\'s order');

// A bad order is ignored; a cap holds a need and the rest flows down.
act(s, 'research.safReAlloc', { order: 'safExp,cases' });
check(s.player.research.safRe.order.join(',') === 'safExp,cases,patches,reval', 'a partial order is ignored');
act(s, 'research.safReAlloc', { need: 'safExp', max: 5 });
const c = safAllocation(s);
check(near(c.got.safExp, 5) && near(c.got.cases, 40) && near(c.got.patches, 10), 'a cap holds a need; the rest flows down');
act(s, 'research.safReAlloc', { need: 'safExp', max: -1 });

// Idle: more engineers than every need → the rest is idle (shown), never pushed onto a need past its demand.
for (const t of safRe) t.heads *= 4;
resetSafAllocation(s);
const e = safAllocation(s);
const dem = NEEDS.reduce((x, k) => x + e.demand[k], 0);
check(NEEDS.every((k) => near(e.got[k], e.demand[k])) && near(e.idle, e.heads - dem) && e.idle > 0, 'spare engineers are idle', `idle ${e.idle.toFixed(1)}`);
check(near(safReAllocView(s).idle, e.idle), 'the view shows the idle engineers');

// SAF_EXP_SHARE is gone.
check(!('SAF_EXP_SHARE' in AG), 'no SAF_EXP_SHARE export');
const bad: string[] = [];
const walk = (dir: string) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) {
  const code = readFileSync(p, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  if (/\bSAF_EXP_SHARE\b/.test(code)) bad.push(p);
} } };
walk('src');
check(bad.length === 0, 'no code reads SAF_EXP_SHARE', bad.join(', '));

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
