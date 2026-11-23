// CP3i targeted check (run alone: npx tsx scripts/v2/_cp3i/check.ts): method efficacy at scale.
//  1. per-world draws q ~ U[METHOD_SCALE.lo, hi] per method from the seed (RF-S10: U[0, 2], two-sided around the tested
//     effect, CAL-S2 update); a migrated save gets its seed's draws;
//  2. at or below a method's tested capability the sourced effect is unchanged (strength 1, both views); above it the
//     true strength moves smoothly to the world's q by +k OOM (above 1 too: stronger at scale); the believed view reads
//     the lab's q range midpoint (q̄ = 1 before any validation, RF-S14), never the draw;
//  3. predicted beliefs after a run whose model outgrew a listed method are wider than the same run at V0's capability.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { gV0 } from '../../../src/engine/v2/models/capability';
import { METHOD_SCALE, METHOD_SCALE_BELIEVED, METHOD_TESTED_OOM } from '../../../src/data/v2/agendas';
import { methodScaleOf } from '../../../src/engine/v2/world/hidden';
import { methodMult, methodQRange, methodRemoval, methodStrength } from '../../../src/engine/v2/safety/methods';
import { predictBeliefs, zeroSignals } from '../../../src/engine/v2/safety/traits';
import type { GameStateV2, PostDesign } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));

// 1. Draws.
const ids = Object.keys(METHOD_TESTED_OOM);
const all = Array.from({ length: 2000 }, (_, i) => methodScaleOf(i * 7919 + 1));
for (const id of ['T-INOC', 'T-ANTISCHEME']) {
  const d = all.map((r) => r[id]);
  const lo = Math.min(...d), hi = Math.max(...d), mean = d.reduce((a, b) => a + b, 0) / d.length;
  const w = METHOD_SCALE.hi - METHOD_SCALE.lo;
  check(lo >= METHOD_SCALE.lo && hi <= METHOD_SCALE.hi && hi - lo > 0.95 * w && Math.abs(mean - METHOD_SCALE_BELIEVED) < 0.03 * w && d.filter((x) => x > 1).length / d.length > 0.45,
    `${id} draws span U[${METHOD_SCALE.lo}, ${METHOD_SCALE.hi}], about half above the tested effect`, `min ${lo.toFixed(3)} max ${hi.toFixed(3)} mean ${mean.toFixed(3)}, above 1 ${(d.filter((x) => x > 1).length / d.length * 100).toFixed(0)}%`);
}
const corr = (() => {
  const a = all.map((r) => r['T-INOC'] - METHOD_SCALE_BELIEVED), b = all.map((r) => r['T-ANTISCHEME'] - METHOD_SCALE_BELIEVED);
  return a.reduce((x, y, i) => x + y * b[i], 0) / Math.sqrt(a.reduce((x, y) => x + y * y, 0) * b.reduce((x, y) => x + y * y, 0));
})();
check(Math.abs(corr) < 0.08, 'methods draw independently', `corr ${corr.toFixed(3)}`);
const s = load();
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV >= 97, 'migrates to SCHEMA_REV (>= 97)');
check(JSON.stringify(s.hidden.methodScale) === JSON.stringify(methodScaleOf(s.setup.seed)) && ids.every((id) => typeof s.hidden.methodScale[id] === 'number'), 'migrated save gets its seed\'s draws', ids.map((id) => `${id} ${s.hidden.methodScale[id].toFixed(2)}`).join(', '));

// 2. Strength by capability.
for (const id of ['T-INOC', 'T-ANTISCHEME', 'T-PERSONA']) {
  const t = METHOD_TESTED_OOM[id].oom;
  s.hidden.methodScale[id] = 0.2;
  const at = (o: number, v: 'true' | 'believed' = 'true') => methodStrength(s, id, o, v);
  const curve = [-1, 0, 0.5, 1, 1.5, 2, 4].map((d) => at(t + d));
  const steps = curve.slice(1).map((x, i) => Math.abs(x - curve[i]));
  check(at(t - 1) === 1 && at(t) === 1 && Math.abs(at(t + 1) - 0.6) < 1e-9 && Math.abs(at(t + 2) - 0.2) < 1e-9 && at(t + 6) === at(t + 2) && Math.max(...steps) < 0.31,
    `${id}: sourced at ≤ tested (${t} OOM), → q by +${METHOD_SCALE.k} OOM, smooth`, curve.map((x) => x.toFixed(3)).join(' '));
  const b1 = at(t + 3, 'believed');
  s.hidden.methodScale[id] = 0.9;
  const qbar = methodQRange(s, id, t + 3).mid;
  check(at(t + 3, 'believed') === b1 && Math.abs(b1 - qbar) < 1e-9 && at(t + 3) === 0.9, `${id}: believed reads the lab's q̄ (${qbar}), never the draw`, `believed ${b1}, true ${at(t + 3)}`);
  s.hidden.methodScale[id] = 1.6;
  check(Math.abs(at(t + 2) - 1.6) < 1e-9 && at(t + 6) === at(t + 2), `${id}: a q above 1 strengthens the method at scale (two-sided)`, `true at +2 OOM ${at(t + 2).toFixed(3)}`);
}
s.hidden.methodScale['T-INOC'] = 0.2;
const inoc0 = methodMult(s, 'T-INOC', 0.15, 'true', 0), inocHi = methodMult(s, 'T-INOC', 0.15, 'true', 13.8), inocNone = methodMult(s, 'T-INOC', 0.15, 'true');
check(inoc0 === inocNone && inocHi > inoc0, 'inoculation ×0.15-scaled cut at V0 unchanged; weaker at ASI in a q 0.2 world', `V0 ×${inoc0.toFixed(3)}, ASI ×${inocHi.toFixed(3)}`);
s.hidden.methodScale['T-ANTISCHEME'] = 0.9;
const as0 = methodRemoval(s, 'T-ANTISCHEME', 0.95, 'true', 0), asHi = methodRemoval(s, 'T-ANTISCHEME', 0.95, 'true', 13.8);
check(as0 === methodRemoval(s, 'T-ANTISCHEME', 0.95, 'true') && asHi < as0, 'anti-scheming removal at V0 unchanged; at ASI q-scaled', `V0 ${as0.toFixed(3)}, ASI ${asHi.toFixed(3)} (q ${s.hidden.methodScale['T-ANTISCHEME'].toFixed(2)})`);

// 3. Predicted beliefs widen past the tested capability.
const v = internalVersion(s)!;
for (const id of ['T-INOC', 'T-ANTISCHEME']) if (s.player.safety.techniques[id]) s.player.safety.techniques[id].unlocked = true;
const post: PostDesign = { ...(v.design as PostDesign), methods: ['T-INOC', 'T-ANTISCHEME'] };
const sg = { ...zeroSignals(), S2: 0.4, S7: 0.4 };
const g0 = gV0(s.hidden.timeline);
const pb = (G: number) => predictBeliefs(s, v.beliefs, sg, 0.6, post, v.lineage ?? 'L-check', 0.6, undefined, 0.6, G, false, undefined, 'predicted', 0.04, v, 0.3);
const lo = pb(g0), hi = pb(g0 + 6);
const traits = ['PERSONA', 'AF', 'SCHEME', 'SAND'] as const;
check(traits.some((t) => hi[t].sd > lo[t].sd + 1e-4), 'predicted sd wider when the model outgrew the methods', traits.map((t) => `${t} ${lo[t].sd.toFixed(3)} → ${hi[t].sd.toFixed(3)}`).join(', '));
s.hidden.methodScale['T-INOC'] = 0.01; s.hidden.methodScale['T-ANTISCHEME'] = 0.01;
const hi2 = pb(g0 + 6);
check(traits.every((t) => hi2[t].est === hi[t].est && hi2[t].sd === hi[t].sd), 'prediction never reads the draws');

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
