// RD-M01 check: the measured level is fitted from the benchmark scores (DD-08): a sandbagging model reads below its true
// level, weak elicitation reads lower than strong, and no stored error draw is left. Run alone: npx tsx scripts/v2/rdm01.ts
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { runEvalSuite } from '../../src/engine/v2/models/benchmarks';
import { measuredDomain } from '../../src/engine/v2/actors/commitments';
import type { GameStateV2, ModelVersion } from '../../src/engine/v2/types';

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'pass' : 'FAIL'} ${msg}`);
  if (!ok) fail++;
};
const game = (seed: number) => newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false }));
/** Mean measured level (general, RSCH) of V0 with SAND = `sand` over `n` suites of `depth` on fresh worlds. */
function read(sand: number, depth: 'basic' | 'full' | 'deep', n = 12) {
  let L = 0, rsch = 0, truth = 0, truthR = 0;
  for (let i = 0; i < n; i++) {
    const s: GameStateV2 = game(100 + i);
    const v = s.player.models.versions[0] as ModelVersion;
    v.traitsTrue.SAND = sand;
    v.evals.bench = {}; // RF-R2: readings pool over suites; read this suite alone (the start scores were taken at SAND 0)
    runEvalSuite(s, makeCtx(s), v.id, 'self', depth);
    L += v.evals.measuredL! / n;
    rsch += measuredDomain(v, 'RSCH') / n;
    truth += v.Lg / n;
    truthR += v.domains.RSCH / n;
    check(!('errTrue' in v.evals), `seed ${100 + i} ${depth} SAND ${sand}: no stored error draw`);
  }
  return { L, rsch, truth, truthR };
}
const honest = read(0, 'full');
const sand = read(1, 'full');
const basic = read(0, 'basic');
const deep = read(0, 'deep');
console.log(JSON.stringify({ honest, sand, basic, deep }, (_k, x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)));
check(Math.abs(honest.L - honest.truth) < 0.15, `honest model, full suite: measured ${honest.L.toFixed(2)} ≈ true ${honest.truth.toFixed(2)}`);
check(sand.L < sand.truth && sand.L < honest.L - 0.15, `sandbagging model (SAND 1): measured ${sand.L.toFixed(2)} < true ${sand.truth.toFixed(2)} and < honest ${honest.L.toFixed(2)} − 0.15`);
check(sand.rsch < sand.truthR - 0.5 && sand.rsch < honest.rsch - 0.8, `sandbagging model: measured RSCH ${sand.rsch.toFixed(2)} < true ${sand.truthR.toFixed(2)} − 0.5, honest ${honest.rsch.toFixed(2)} − 0.8 (dangerous benches)`);
check(basic.L < honest.L && honest.L < deep.L, `elicitation flows through: basic ${basic.L.toFixed(2)} < full ${honest.L.toFixed(2)} < deep ${deep.L.toFixed(2)}`);
const s0 = game(1);
const v0 = s0.player.models.versions[0];
check(v0.evals.measuredL !== undefined && v0.evals.measuredDom?.CODE !== undefined && !('errTrue' in v0.evals), `start model: fitted from its start scores (L ${v0.evals.measuredL}, true ${v0.Lg.toFixed(2)})`);
process.exit(fail ? 1 : 0);
