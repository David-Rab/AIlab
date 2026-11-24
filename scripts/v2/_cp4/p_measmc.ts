// CP4 probe 2: Monte Carlo of the RD-M01 fit on Atlas-4.0 (day 900): noisy bench tables (the engine's noise, clip,
// rounding) fitted as the engine does vs. the same with each reading's weight taken at the noiseless score.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { applyFit, benchGen, benchLevel, benchReading, benchScore, fitGeneral, sandbagGap } from '../../../src/engine/v2/models/benchmarks';
import { BENCHMARKS, BENCH_NOISE_SD } from '../../../src/data/v2/benchmarks';
import { Rng } from '../../../src/engine/rng';
import type { DomainId } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';
const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day900.json'), 'utf8'));
const w = s.hidden.timeline;
const rng = new Rng(11);
for (const name of ['Atlas-4.0', 'Atlas-3.5', 'Atlas-3.0']) {
  const v = s.player.models.versions.find((x) => x.name === name)!;
  const ids = Object.keys(v.evals.bench);
  let a = 0, b2 = 0, clipped = 0, n = 0; const N = 300;
  for (let k = 0; k < N; k++) {
    const c = structuredClone(v);
    const acc: Partial<Record<DomainId, { w: number; wl: number }>> = {};
    for (const b of BENCHMARKS) {
      const r = c.evals.bench[b.id];
      if (!ids.includes(b.id) || b.special) continue;
      const mean = benchScore(b, benchLevel(v, b) + sandbagGap(v, b), 0, 0, benchGen(s, b.id), false);
      const x = mean + rng.normal(0, BENCH_NOISE_SD[r.by]);
      if (x >= b.ceil || x <= b.floor) clipped++;
      n++;
      r.score = Math.round(Math.min(b.ceil, Math.max(b.floor, x)) * 10) / 10;
      r.sd = BENCH_NOISE_SD[r.by];
      const xr = benchReading(b, r.score, r.sd, benchGen(s, b.id));
      const x0 = benchReading(b, mean, r.sd, benchGen(s, b.id));
      if (!xr || !x0 || Array.isArray(b.domain)) continue;
      const q = (acc[b.domain as DomainId] ??= { w: 0, wl: 0 });
      q.w += 1 / (x0.sd * x0.sd); q.wl += xr.L / (x0.sd * x0.sd);
    }
    applyFit(w, c, (id) => benchGen(s, id), false);
    a += c.evals.measuredL! - v.Lg;
    const dom: Partial<Record<DomainId, number>> = {}, sd: Partial<Record<DomainId, number>> = {};
    for (const [d, q] of Object.entries(acc) as [DomainId, { w: number; wl: number }][]) { dom[d] = q.wl / q.w; sd[d] = 1 / Math.sqrt(q.w); }
    b2 += (fitGeneral(w, v, dom, sd)?.L ?? NaN) - v.Lg;
  }
  console.log(`${name} (true ${v.Lg.toFixed(2)}, ${ids.length} benches): engine fit mean offset ${(a / N).toFixed(3)}; weights at the noiseless score ${(b2 / N).toFixed(3)}; clipped readings ${(100 * clipped / n).toFixed(1)}%`);
}
