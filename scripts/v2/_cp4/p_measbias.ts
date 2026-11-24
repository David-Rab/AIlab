// CP4 probe: measured level vs true, split into fit bias (noiseless, no elicitation), elicitation / sandbagging, noise.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { applyFit, benchGen, benchLevel, benchScore, sandbagGap } from '../../../src/engine/v2/models/benchmarks';
import { BENCHMARKS, BENCH_NOISE_SD } from '../../../src/data/v2/benchmarks';
import { FIXTURE_DIR } from '../lib';
for (const fx of ['day400.json', 'day900.json']) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, fx), 'utf8'));
  const w = s.hidden.timeline;
  for (const v of s.player.models.versions) {
    if (v.evals.measuredL === undefined) continue;
    const fit = (elic: boolean) => {
      const c = structuredClone(v);
      for (const b of BENCHMARKS) {
        const r = c.evals.bench[b.id];
        if (!r || b.special) continue;
        const basic = r.sd > (BENCH_NOISE_SD[r.by] ?? 2) * 1.5;
        const e = elic ? (basic ? -0.2 : 0) + sandbagGap(v, b) : 0;
        r.score = benchScore(b, benchLevel(v, b) + e, 0, 0, benchGen(s, b.id), false);
      }
      applyFit(w, c, (id) => benchGen(s, id), s.setup.alignment === 'hard');
      return c.evals.measuredL!;
    };
    const n = Object.keys(v.evals.bench).length;
    const nBasic = BENCHMARKS.filter((b) => v.evals.bench[b.id] && v.evals.bench[b.id].sd > (BENCH_NOISE_SD[v.evals.bench[b.id].by] ?? 2) * 1.5).length;
    console.log(`${fx} ${v.name.padEnd(16)} true ${v.Lg.toFixed(2)} measured ${(v.evals.measuredL - v.Lg).toFixed(2).padStart(6)} | noiseless no-elic ${(fit(false) - v.Lg).toFixed(2).padStart(6)} | noiseless + elic/sandbag ${(fit(true) - v.Lg).toFixed(2).padStart(6)} | ${n} benches, ${nBasic} basic`);
  }
}
