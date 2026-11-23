// SR-07b targeted check (run alone: npx tsx scripts/v2/_sr07b/check.ts): the believed test-vs-real gap widens the
// trait beliefs themselves through the evidence path.
//  1. realUseReading: a wider gap band gives a noisier, higher real-use reading; no gap leaves the test reading;
//  2. the same suite (same draws) on a model whose believed eval awareness is wide / high leaves wider SCHEME, SAND, RH
//     beliefs than on one whose awareness is known small; evalAware / honesty evidence is the raw test rate;
//  3. the stored k / n records stay test-scale; the gap readout's test side reads them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { Rng } from '../../../src/engine/rng';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { realUseReading, runAlignmentEvals, testGapView } from '../../../src/engine/v2/safety/alignmentEvals';
import type { GameStateV2, TraitId } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));

const a = realUseReading(0.2, 0.05, { gLo: 1, gHi: 1 });
const b = realUseReading(0.2, 0.05, { gLo: 1.05, gHi: 1.15 });
const c = realUseReading(0.2, 0.05, { gLo: 1.1, gHi: 2.5 });
check(a.reading === 0.2 && a.sigma === 0.05, 'no gap: the test reading', `${a.reading}±${a.sigma}`);
check(c.sigma > b.sigma && b.sigma > a.sigma && c.reading > b.reading, 'a wider gap: noisier, higher reading', `${b.reading}±${b.sigma} vs ${c.reading}±${c.sigma}`);

const run = (eaEst: number, eaSd: number) => {
  const s = load();
  const v = internalVersion(s)!;
  const day = s.time.day + 1;
  for (const t of ['SCHEME', 'SAND', 'RH', 'POWER', 'EA'] as TraitId[]) v.beliefs[t] = { ...v.beliefs[t], est: 0.2, sd: 0.2, evidence: [] };
  v.beliefs.EA = { ...v.beliefs.EA, est: eaEst, sd: eaSd };
  for (const t of ['SCHEME', 'SAND', 'POWER', 'RH'] as TraitId[]) v.beliefs[t].evidence = [];
  runAlignmentEvals(s, new Rng(11), day, v, 'self', 1, 1 - 0.8 * v.traitsTrue.EA);
  return { v, gap: testGapView(v), day };
};
const known = run(0.05, 0.01), unknown = run(0.5, 0.2);
const iv = (x: { v: ReturnType<typeof run>['v'] }, t: TraitId) => 2 * 1.645 * x.v.beliefs[t].sd;
const traits: TraitId[] = ['SCHEME', 'SAND', 'RH', 'POWER'];
check(traits.every((t) => iv(unknown, t) > iv(known, t) + 1e-3), 'a larger believed gap gives wider trait-belief intervals',
  traits.map((t) => `${t} ${iv(known, t).toFixed(3)} → ${iv(unknown, t).toFixed(3)}`).join(', ') + `; gap ×${known.gap.gLo}–${known.gap.gHi} vs ×${unknown.gap.gLo}–${unknown.gap.gHi}`);
check(JSON.stringify(known.v.evals.safety) === JSON.stringify(unknown.v.evals.safety), 'same draws: stored k / n records identical (test scale)');
const ea = known.v.evals.safety.evalAware;
const eaEv = known.v.beliefs.EA.evidence.find((e) => e.source === 'eval/BB/evalAware' && e.day === known.day);
check(!!eaEv && Math.abs(eaEv.reading - ea.rate) < 1e-9, 'eval-awareness evidence is the raw test rate', `${ea.k}/${ea.n}`);
const hr = unknown.v.evals.safety.hackRate;
const rhEv = unknown.v.beliefs.RH.evidence.find((e) => e.source === 'eval/BB/hackRate');
check(!!rhEv && (hr.rate < 0.02 || rhEv.reading > hr.rate), 'misbehaviour evidence is on the real-use scale', `hackRate ${hr.k}/${hr.n} → reading ${rhEv?.reading}±${rhEv?.noise}`);

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
