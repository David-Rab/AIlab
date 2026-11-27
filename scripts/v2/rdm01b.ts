// RD-M01b check: MEDIA and PHYS measured levels come from their benchmark rows (MMMU, EmbodiedBench), not from the
// measured general level + the true offset; sandbagging (dangerous evals only) leaves them unchanged. Run alone: npx tsx scripts/v2/rdm01b.ts
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { runEvalSuite } from '../../src/engine/v2/models/benchmarks';
import { measuredDomain } from '../../src/engine/v2/actors/commitments';
import type { DomainId, GameStateV2, ModelVersion } from '../../src/engine/v2/types';

let fail = 0;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'pass' : 'FAIL'} ${msg}`);
  if (!ok) fail++;
};
const DS: DomainId[] = ['MEDIA', 'PHYS'];
const TRUE = { MEDIA: 4, PHYS: 3 } as Record<DomainId, number>;
/** Mean measured MEDIA / PHYS of V0 (true MEDIA 4, PHYS 3) with SAND = `sand` over `n` full suites. */
function read(sand: number, n = 12) {
  const out = { MEDIA: 0, PHYS: 0 } as Record<DomainId, number>;
  for (let i = 0; i < n; i++) {
    const s: GameStateV2 = newGame(defaultSetupV2({ seed: 200 + i, world: 'tl-central', alignment: 'medium', baseline: 'classic', tutorial: false }));
    const v = s.player.models.versions[0] as ModelVersion;
    for (const d of DS) v.domains[d] = TRUE[d];
    v.traitsTrue.SAND = sand;
    runEvalSuite(s, makeCtx(s), v.id, 'self', 'full');
    for (const d of DS) {
      const fit = v.evals.measuredDom?.[d];
      const leak = v.evals.measuredL! + (v.domains[d] - v.Lg);
      if (i === 0) check(fit !== undefined && measuredDomain(v, d) === fit, `seed ${200 + i} SAND ${sand}: ${d} read from its fit ${fit} (old fallback would give ${leak.toFixed(2)})`);
      out[d] += measuredDomain(v, d) / n;
    }
  }
  return out;
}
const honest = read(0);
const sand = read(1);
console.log(JSON.stringify({ honest, sand }, (_k, x) => (typeof x === 'number' ? Math.round(x * 100) / 100 : x)));
for (const d of DS) {
  check(Math.abs(honest[d] - TRUE[d]) < 0.5, `honest ${d}: measured ${honest[d].toFixed(2)} ≈ true ${TRUE[d]}`);
  check(Math.abs(sand[d] - honest[d]) < 0.3, `sandbagging ${d}: not a dangerous eval, measured ${sand[d].toFixed(2)} ≈ honest ${honest[d].toFixed(2)}`);
}
process.exit(fail ? 1 : 0);
