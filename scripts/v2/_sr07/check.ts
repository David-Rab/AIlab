// SR-07 targeted check (run alone: npx tsx scripts/v2/_sr07/check.ts): alignment evals as evidence, test-vs-real gap.
//  1. the day-400 fixture migrates to 93; its eval records are k of n with an interval;
//  2. a suite adds k / n records with Wilson intervals and an "eval/BB/<id>" evidence item per trait read;
//  3. a wider / higher believed eval awareness widens the believed real-use band;
//  4. the readouts read no truth: rewriting true traits leaves alignmentEvalView unchanged.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { Rng } from '../../../src/engine/rng';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { runEvalSuite } from '../../../src/engine/v2/models/benchmarks';
import { alignmentEvalView, wilson } from '../../../src/engine/v2/safety/alignmentEvals';
import type { GameStateV2, SystemCtx } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const rng = new Rng(7);
const ctx = (day: number) => ({ day, rng: () => rng, log: () => {}, headline: () => {} }) as unknown as SystemCtx;

const s = load();
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV === 93, 'migrates to 93');
const recs = s.player.models.versions.flatMap((v) => Object.values(v.evals.safety));
check(recs.every((r) => r.n && r.k !== undefined && r.lo !== undefined && r.hi !== undefined && r.lo <= r.rate && r.rate <= r.hi), 'migrated records are k of n with an interval', `${recs.length} records`);

const v = internalVersion(s)!;
const day = s.time.day + 1;
const before = Object.fromEntries(Object.entries(v.beliefs).map(([t, b]) => [t, b.evidence.length]));
runEvalSuite(s, ctx(day), v.id, 'self', 'full');
const view = alignmentEvalView(v);
check(view.rows.length === 6 && view.rows.every((r) => r.n === 40 && r.day === day), 'suite writes six k of 40 results', view.rows.map((r) => `${r.id} ${r.k}/${r.n} ${r.lo}-${r.hi}`).join(', '));
check(view.rows.every((r) => { const w = wilson(r.k, r.n); return Math.abs(w.lo - r.lo) < 1e-3 && Math.abs(w.hi - r.hi) < 1e-3; }), 'intervals are 90% Wilson');
const scheme = v.beliefs.SCHEME.evidence.filter((e) => e.day === day && e.source.startsWith('eval/BB/'));
check(scheme.length === 2 && scheme.some((e) => e.source === 'eval/BB/schemeProbe') && scheme.some((e) => e.source === 'eval/BB/sabotage'), 'SCHEME gets one evidence item per eval reading it', scheme.map((e) => `${e.source} ${e.reading}±${e.noise}`).join('; '));
check(Object.keys(before).every((t) => (v.beliefs[t as 'EA'].evidence.length >= Math.min(20, before[t]))), 'evidence lists grow or stay capped');

// 3. believed awareness widens the real-use band.
const eaB = v.beliefs.EA;
v.beliefs.EA = { ...eaB, est: 0.1, sd: 0.03 };
const lo = alignmentEvalView(v);
v.beliefs.EA = { ...eaB, est: 0.5, sd: 0.1 };
const hi = alignmentEvalView(v);
const width = (x: typeof lo, id: string) => { const r = x.rows.find((q) => q.id === id)!; return r.realHi - r.realLo; };
check(hi.gap.gHi > lo.gap.gHi && width(hi, 'schemeProbe') >= width(lo, 'schemeProbe') && width(hi, 'hackRate') > width(lo, 'hackRate'), 'higher believed awareness widens the real-use band',
  `gap ×${lo.gap.gLo}-${lo.gap.gHi} → ×${hi.gap.gLo}-${hi.gap.gHi}; hackRate width ${width(lo, 'hackRate').toFixed(3)} → ${width(hi, 'hackRate').toFixed(3)}`);
check(hi.rows.find((r) => r.id === 'evalAware')!.realHi === hi.rows.find((r) => r.id === 'evalAware')!.hi, 'awareness eval itself is not widened');
v.beliefs.EA = eaB;

// 4. no truth in the readout.
const a = JSON.stringify(alignmentEvalView(v));
for (const t of Object.keys(v.traitsTrue)) v.traitsTrue[t as 'EA'] = 0.99;
check(JSON.stringify(alignmentEvalView(v)) === a, 'readout unchanged with true traits rewritten');

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
