// MK-6c targeted check (design/MARKET.md M5, MK-6c note): μ_b = c_min,b ÷ ε, c_min,b the lowest serving cost per adopted
// hour among the tiers that do band b's tasks adequately (choice.ts bandMu).
//  (a) the game start (default setup), US Software and US Services: per band c_min,b, μ_b and the band's hours by
//      seller and tier (sellers above 1% of the band); μ_b = c_min,b ÷ ε recomputed from the tiers here;
//  (b) the designer's day-369 save: Agent-3-1.0-micro added to Enterprise's lineup, 30 days with and without: revenue and
//      profit (revenue − serving cost at the market rate; MK-6b: 112.7 / 91.4 without, 194.2 / 182.0 with), and US
//      Software's c_min,b with and without at day +0 (what the mini does to the market's price scale).
// Run alone: npx tsx scripts/v2/_mk6c/check.ts
import { readFileSync } from 'node:fs';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { deserialize } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { PRICE_ELASTICITY, SERVE_HOURS_PER_YEAR } from '../../../src/data/v2/serving';
import { worldMix, type SectorMix, type WorldMix } from '../../../src/engine/v2/worldfx/mix';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { serveDollarsPerHour } from '../../../src/engine/v2/worldfx/serving';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const SAVE = 'C:/Users/david/Downloads/ai27-v2-day369.json';
let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const f1 = (x: number) => x.toFixed(1);
const f3 = (x: number) => x.toFixed(3);
const nameOf = (s: GameStateV2, id: string) =>
  s.player.models.versions.find((v) => v.id === id)?.name
  ?? [...s.rivals, s.china.lab].flatMap((r) => [r.publicModel, ...(r.lineup ?? [])]).find((m) => m?.id === id)?.name
  ?? id;

/** c_min,b recomputed from the market's tiers (every serving provider's, x_b = 1: a ≥ the band's upper edge; none: the
 *  most adequate tier's cost). */
function cMin(m: SectorMix): number[] {
  const x = m.rerun;
  const B = x.B;
  const out: number[] = [];
  for (let b = 0; b < B; b++) {
    const hi = (x.aTop * (b + 1)) / B;
    let c = Infinity;
    let aBest = -Infinity;
    let cBest = Infinity;
    x.lineups.forEach((L, i) => {
      if (!(x.acc[i] > 0 && x.brand[i] > 0)) return;
      for (const t of L) {
        const ct = t.cost ?? t.price;
        if (t.a >= hi) c = Math.min(c, ct);
        else if (t.a > aBest || (t.a === aBest && ct < cBest)) (aBest = t.a), (cBest = ct);
      }
    });
    out.push(c < Infinity ? c : cBest);
  }
  return out;
}

function bands(s: GameStateV2, mix: WorldMix, sid: 'SOFT' | 'SERV') {
  const m = mix.sec.US[sid];
  const ch = m.tiers.choice;
  const keys = mix.providers.map((p) => p.key);
  const cm = cMin(m);
  console.log(`(a) US ${sid} at the start (ε = ${PRICE_ELASTICITY}; a_top ${f3(ch.aTop)}): per band c_min $/h, μ $/h, hours by seller: tier @ part of the band`);
  let gap = 0;
  for (let b = 0; b < ch.mu.length; b++) {
    gap = Math.max(gap, Math.abs(ch.mu[b] - cm[b] / PRICE_ELASTICITY) / ch.mu[b]);
    const parts: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const x = ch.share[i][b];
      if (!(x > 0.01)) continue;
      const sb = ch.sub[i]?.[b];
      const w = sb?.length ? sb : m.tiers.weight[i].map((_, k) => (k === ch.pick[i][b] ? 1 : 0));
      const tm = m.tierModel[i];
      const tiers = w.map((y, k) => ({ y, k })).filter((z) => z.y > 0.02).map((z) => `${nameOf(s, m.markupModels[i][tm[z.k]] ?? '?')}${keys[i] === 'player' ? `#${z.k}` : ''} $${f3(m.tiers.price[i][z.k])}${z.y < 0.98 ? ` ×${z.y.toFixed(2)}` : ''}`);
      parts.push(`${keys[i]} ${(100 * x).toFixed(0)}% [${tiers.join(', ')}]`);
    }
    console.log(`    b${b} c_min $${f3(cm[b])} μ $${f3(ch.mu[b])}: ${parts.join('; ')}`);
  }
  check(gap < 1e-12, `(a) US ${sid}: μ_b = c_min,b ÷ ε in every band`, `max rel gap ${gap.toExponential(1)}`);
  return m;
}

{
  const s = newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', tutorial: false }));
  const mix = worldMix(s);
  bands(s, mix, 'SOFT');
  bands(s, mix, 'SERV');
}

function econ(s: GameStateV2) {
  const rd = revenueReadout(s);
  const rate = serveDollarsPerHour(s);
  const per = rd.deps.map((x) => {
    const cost = (Math.min(x.servingH100e, x.needH100e) * SERVE_HOURS_PER_YEAR * rate) / 1e9;
    return { ch: x.channel, rev: x.revenue, profit: x.revenue - cost };
  });
  return { per, rev: per.reduce((a, x) => a + x.rev, 0), profit: per.reduce((a, x) => a + x.profit, 0) };
}
{
  const json = readFileSync(SAVE, 'utf8');
  const s0 = deserialize(json);
  const ent = s0.player.deployments.find((d) => d.channel === 'enterprise' && d.status !== 'withdrawn')!;
  const mini = s0.player.models.versions.find((v) => /Agent-3-1.0-micro/i.test(v.name));
  if (!mini) check(false, '(b) the save has Agent-3-1.0-micro');
  else {
    const runs: Record<string, ReturnType<typeof econ>> = {};
    for (const withMini of [false, true]) {
      const x = deserialize(json);
      if (withMini) {
        const err = act(x, 'product.update', { id: ent.id, lineup: [...(ent.lineup ?? []), mini.id].join(',') });
        if (err) console.log(`    product.update: ${err}`);
      }
      const m0 = worldMix(x).sec.US.SOFT;
      console.log(`(b) day ${x.time.day} ${withMini ? 'with   ' : 'without'} Agent-3-1.0-micro: US SOFT c_min by band $${cMin(m0).map(f3).join(' / ')}`);
      const e0 = econ(x);
      for (let i = 0; i < 30; i++) tick(x, { skip: ['endings'] });
      const e = (runs[withMini ? 'with' : 'without'] = econ(x));
      console.log(`    day+0 rev $${f1(e0.rev)}B profit $${f1(e0.profit)}B → day+30 rev $${f1(e.rev)}B profit $${f1(e.profit)}B/yr: ${e.per.map((y) => `${y.ch} ${f1(y.rev)} / ${f1(y.profit)}`).join(', ')}`);
    }
    console.log(`    30 days: without rev ${f1(runs.without.rev)} profit ${f1(runs.without.profit)}; with rev ${f1(runs.with.rev)} profit ${f1(runs.with.profit)} (MK-6b: 112.7 / 91.4 without, 194.2 / 182.0 with)`);
  }
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exitCode = fails ? 1 : 0;
