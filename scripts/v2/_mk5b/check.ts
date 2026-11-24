// MK-5b targeted check (design/MARKET.md M2, MK-5b row): the player's fit, coverage and G per sector-region are the
// hours-weighted mix of the tiers its buyers buy (per buyer group on the ladder), not its best product's main model, on
// the designer's day-369 save (read-only). "before" = BUYER_LADDER_TEST.bestOnly (the pre-MK-5b aggregation), same state.
//  (a) per US sector: the player's split API/Enterprise/Vetted per group, its coverage and the sector's F before/after;
//      after = an independent product path (Σ_products playerProdW × Σ_tiers playerTierW × the tier's coverage);
//  (b) the comparison, with every group reaching every product (BUYER_LADDER_TEST.allReach): per sector-region the new
//      coverage, fit, F and g equal the old best-product values where the player's buyers all buy the best product's
//      main model (or the player has no target share: the fallback), and differ from them wherever some of its hours
//      are on a tier whose coverage differs from the best product's main model;
//  (c) 30 ticks without throwing.
// Run alone: npx tsx scripts/v2/_mk5b/check.ts
import { readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { tick } from '../../../src/engine/v2/core/loop';
import { BUYER_GROUP_IDS, BUYER_LADDER_TEST, worldMix, type SectorMix } from '../../../src/engine/v2/worldfx/mix';
import { SAVE } from '../_mk5/dump';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const json = readFileSync(SAVE, 'utf8');
const load = () => deserialize(json);
const s0 = load();
const ch = Object.fromEntries(s0.player.deployments.map((d) => [d.id, d.channel]));
/** The save with one sector product left, its main model alone (its other sector products withdrawn, no lineup). */
const oneProduct = () => {
  const s = load();
  let kept = false;
  for (const d of s.player.deployments) {
    if (d.status === 'withdrawn' || !['api', 'enterprise', 'vetted'].includes(d.channel)) continue;
    if (!kept && d.channel === 'api') {
      kept = true;
      d.lineup = [];
    } else d.status = 'withdrawn';
  }
  return s;
};
const mixWith = (bestOnly: boolean, allReach = false, mk = load) => {
  BUYER_LADDER_TEST.bestOnly = bestOnly;
  BUYER_LADDER_TEST.allReach = allReach;
  const m = worldMix(mk());
  BUYER_LADDER_TEST.bestOnly = false;
  BUYER_LADDER_TEST.allReach = false;
  return m;
};
const pct = (x: number) => `${(100 * x).toFixed(0).padStart(3)}%`;
const byCh = (w: Record<string, number>) => {
  const o: Record<string, number> = { api: 0, enterprise: 0, vetted: 0 };
  for (const [id, x] of Object.entries(w)) o[ch[id]] = (o[ch[id]] ?? 0) + x;
  return o;
};
/** The player's coverage with each product at its main model (the product split alone, no tiers). */
const mainOnly = (m: SectorMix) => {
  let a = 0;
  let z = 0;
  for (const [id, w] of Object.entries(m.playerProdW)) {
    const L = m.playerLines[id];
    if (!L?.length || !(w > 0)) continue;
    a += w * L[0].a;
    z += w;
  }
  return z > 0 ? a / z : NaN;
};
/** The player's coverage by the product path: Σ_d prodW_d × Σ_k tierW_d,k × a of tier k of product d. */
const productPath = (m: SectorMix) => {
  let a = 0;
  let z = 0;
  for (const [id, w] of Object.entries(m.playerProdW)) {
    const L = m.playerLines[id];
    const tw = m.playerTierW[id];
    if (!L || !tw || !(w > 0)) continue;
    for (let k = 0; k < L.length; k++) {
      a += w * tw[k] * L[k].a;
      z += w * tw[k];
    }
  }
  return z > 0 ? a / z : NaN;
};

// (a) the ladder, US.
const before = mixWith(true);
const after = mixWith(false);
const pi = after.providers.findIndex((p) => p.key === 'player');
console.log(`day ${s0.time.day}; products: ${s0.player.deployments.filter((d) => d.status !== 'withdrawn').map((d) => `${d.id} ${d.channel}${d.held ? ' (held)' : ''}`).join(', ')}`);
console.log(`\n(a) US, with the ladder: per group its share of buyers, the player's target share there, its split API/Ent/Vet; the player's coverage and the sector's F before (best product) → after (MK-5b)`);
let pathBad = 0;
let pathN = 0;
for (const [sid, m] of Object.entries(after.sec.US)) {
  const b = before.sec.US[sid as keyof typeof before.sec.US];
  const cells = BUYER_GROUP_IDS.map((g) => {
    const x = m.byGroup[g];
    if (!x) return `${g} -`.padEnd(28);
    const c = byCh(x.playerProdW);
    return `${g} ${pct(x.w)} pl ${pct(x.target[pi])} ${pct(c.api)}/${pct(c.enterprise)}/${pct(c.vetted)}`.padEnd(28);
  });
  const pp = productPath(m);
  if (m.target[pi] > 1e-12 && Number.isFinite(pp)) {
    pathN++;
    if (Math.abs(pp - m.cover[pi]) > 1e-9) pathBad++;
  }
  console.log(`  ${sid.padEnd(6)} ${cells.join(' | ')} || cover ${b.cover[pi].toFixed(3)} → ${m.cover[pi].toFixed(3)} (products' main models ${mainOnly(m).toFixed(3)})  F ${b.F.toFixed(4)} → ${m.F.toFixed(4)} (${(m.F - b.F >= 0 ? '+' : '')}${(m.F - b.F).toFixed(4)})  g.REASON ${b.g.REASON.toFixed(3)} → ${m.g.REASON.toFixed(3)}`);
}
check(pathBad === 0, "(a) the player's coverage = its products' hours × their tiers' coverage (the product path)", `${pathBad} of ${pathN} sector-regions differ`);
let moved = 0;
for (const r of ['US', 'ROW', 'CN'] as const) for (const [sid, m] of Object.entries(after.sec[r])) if (Math.abs(m.F - before.sec[r][sid as keyof typeof before.sec.US].F) > 1e-12) moved++;
console.log(`     F moves in ${moved} of ${3 * Object.keys(after.sec.US).length} sector-regions`);

// (b) every group reaches every product: on the save, and on the save with one sector product at its main model alone.
let eqN = 0;
let eqBad = 0;
let neN = 0;
let neBad = 0;
let same = 0;
for (const mk of [load, oneProduct]) {
const oldA = mixWith(true, true, mk);
const newA = mixWith(false, true, mk);
for (const r of ['US', 'ROW', 'CN'] as const) for (const [sid, m] of Object.entries(newA.sec[r])) {
  const o = oldA.sec[r][sid as keyof typeof oldA.sec.US];
  const best = m.playerDep;
  const tw = m.tiers.weight[pi];
  const L = m.tiers.offers[pi];
  const dep = m.rerun.tierDep;
  const k0 = dep.indexOf(best ?? '');
  const all = !(m.target[pi] > 1e-12) || (k0 >= 0 && tw[k0] >= 1 - 1e-9);
  const dg = Math.max(...Object.keys(m.g).map((d) => Math.abs(m.g[d as keyof typeof m.g] - o.g[d as keyof typeof o.g])));
  const d = Math.max(Math.abs(m.cover[pi] - o.cover[pi]), Math.abs(m.fit[pi] - o.fit[pi]), Math.abs(m.F - o.F), dg);
  if (all) {
    eqN++;
    if (d > 1e-12) eqBad++;
  } else if (k0 >= 0 && tw.some((x, k) => x > 1e-9 && Math.abs(L[k].a - L[k0].a) > 1e-9)) {
    neN++;
    if (!(Math.abs(m.cover[pi] - o.cover[pi]) > 1e-12)) neBad++;
  } else same++;
}
}
check(eqBad === 0, '(b) all groups reach all products: equal to the best-product values where all the player\'s buyers buy its main model (or it has none)', `${eqN} such sector-regions, ${eqBad} differ`);
check(neBad === 0, '(b) … and the coverage differs wherever some of its hours are on a tier of other coverage', `${neN} such sector-regions, ${neBad} equal; ${same} others (bought tiers of the same coverage)`);

// (c) 30 ticks.
let err = '';
try {
  const s = load();
  for (let i = 0; i < 30; i++) tick(s);
} catch (e) { err = String((e as Error)?.stack ?? e); }
check(!err, '(c) 30 ticks without throwing', err.split('\n').slice(0, 4).join(' | '));

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
