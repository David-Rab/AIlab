// MK-5b targeted check (design/MARKET.md M2, MK-5b row): the player's fit, coverage and G per sector-region are the
// hours-weighted mix of the tiers its buyers buy (per buyer group on the ladder), not its best product's main model, on
// the designer's day-369 save (read-only). "before" = BUYER_LADDER_TEST.bestOnly (the pre-MK-5b aggregation), same state.
//  (a) per US sector: the player's split API/Enterprise/Vetted per group, its coverage and the sector's F before/after;
//      after = an independent product path (Σ_products playerProdW × Σ_tiers playerTierW × the tier's coverage);
//  (b) the comparison, with every group reaching every product (BUYER_LADDER_TEST.allReach): per sector-region the new
//      coverage, fit, F and g equal the old best-product values where the player's buyers all buy the best product's
//      main model (or the player has no target share: the fallback), and differ from them wherever some of its hours
//      are on a tier whose coverage differs from the best product's main model;
//  (d) MK-5c: the player's agentK the same way (see (d) below);
//  (c) 30 ticks without throwing.
// Run alone: npx tsx scripts/v2/_mk5b/check.ts
import { readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { tick } from '../../../src/engine/v2/core/loop';
import { BUYER_GROUP_IDS, BUYER_LADDER_TEST, worldMix, type SectorMix } from '../../../src/engine/v2/worldfx/mix';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { agentMixOf, wagePerHour } from '../../../src/engine/v2/worldfx/serving';
import { workHoursOf } from '../../../src/engine/v2/worldfx/use';
import { kycDemandFactor } from '../../../src/engine/v2/models/deployments';
import { productUsageMult } from '../../../src/engine/v2/safety/safeguards';
import type { SectorId } from '../../../src/engine/v2/types';
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

// (d) MK-5c: agentK (agent-hours per supervising hour) by what the player's buyers buy.
//  (d1) every group reaching every product: equal to the old value where all the player's buyers buy the best product's
//       main model (or it has no target share);
//  (d2) the product path: Σ_d playerProdW_d × agentMixOf(its lineup, its playerTierW).k × the ceiling's fill = agentK;
//  (d3) revenue: the player's agent-hours (revenueReadout playerAgent) = its stock share × supervising hours × agentK
//       (below it only where a product factor, KYC or restriction, or the ceiling's room scales them);
//  (d4) the save: US agentK before → after per sector, total agent-hour demand before → after.
{
  let eqN = 0;
  let eqBad = 0;
  let diff = 0;
  for (const mk of [load, oneProduct]) {
    const oldA = mixWith(true, true, mk);
    const newA = mixWith(false, true, mk);
    for (const r of ['US', 'ROW', 'CN'] as const) for (const [sid, m] of Object.entries(newA.sec[r])) {
      const o = oldA.sec[r][sid as SectorId];
      const k0 = m.rerun.tierDep.indexOf(m.playerDep ?? '');
      const all = !(m.target[pi] > 1e-12) || (k0 >= 0 && m.tiers.weight[pi][k0] >= 1 - 1e-9);
      const d = Math.abs(m.agentK[pi] - o.agentK[pi]) + Math.abs(m.agentPrices[pi] - o.agentPrices[pi]);
      if (all) {
        eqN++;
        if (d > 1e-9 * (1 + o.agentK[pi] + o.agentPrices[pi])) eqBad++;
      } else if (d > 1e-12) diff++;
    }
  }
  check(eqBad === 0, "(d1) agentK equal to the old value where all the player's buyers buy the best product's main model", `${eqN} such sector-regions, ${eqBad} differ; ${diff} others move`);

  let bad = 0;
  let n = 0;
  for (const mk of [load, oneProduct]) {
    const mm = mixWith(false, false, mk);
    for (const r of ['US', 'ROW', 'CN'] as const) for (const [sid, m] of Object.entries(mm.sec[r])) {
      if (!(m.target[pi] > 1e-12)) continue;
      const wage = wagePerHour(sid as SectorId, r);
      let k = 0;
      for (const [id, w] of Object.entries(m.playerProdW)) if (w > 0 && m.playerLines[id]) k += w * agentMixOf(m.playerLines[id], m.playerTierW[id], wage).k;
      k *= m.agentCeiling.fill;
      n++;
      if (Math.abs(k - m.agentK[pi]) > 1e-9 * (1 + m.agentK[pi])) bad++;
    }
  }
  check(bad === 0, "(d2) the products' agent-hours per supervising hour sum to the sector's agentK", `${bad} of ${n} sector-regions differ`);

  const s = load();
  const mm = worldMix(s);
  const rv = revenueReadout(s, mm);
  const scaled = s.player.deployments.some((d) => d.status !== 'withdrawn' && (kycDemandFactor(d) !== 1 || productUsageMult(d) !== 1));
  let rb = 0;
  let rn = 0;
  let req = 0;
  for (const r of ['US', 'ROW', 'CN'] as const) for (const [sid, m] of Object.entries(mm.sec[r])) {
    const x = m.share[pi];
    if (!(x > 0)) continue;
    const want = x * workHoursOf(s.world.sectors[r][sid as SectorId], sid as SectorId).supervising * m.agentK[pi];
    const got = rv.playerAgent[r][sid as SectorId] ?? 0;
    rn++;
    const e = Math.abs(got - want) / Math.max(1, want);
    if (e <= 1e-9) req++;
    else if (got > want) rb++; // the ceiling's room or a product factor can only lower them
  }
  check(rb === 0, "(d3) revenue's agent-hours = share × supervising hours × agentK (≤ where a product factor or the room binds)", `${rn} sector-regions, ${req} equal, ${rb} above${scaled ? '; some product factor ≠ 1' : ''}`);

  const rev = (bestOnly: boolean) => {
    BUYER_LADDER_TEST.bestOnly = bestOnly;
    const st = load();
    const m = worldMix(st);
    const out = revenueReadout(st, m);
    BUYER_LADDER_TEST.bestOnly = false;
    return { m, out };
  };
  const b = rev(true);
  const a = rev(false);
  console.log(`\n(d4) US: the player's agentK (agent-hours per supervising hour, after the ceiling) before (best product) → after (MK-5c), its price per agent-hour, its agent-hours a year`);
  for (const [sid, m] of Object.entries(a.m.sec.US)) {
    const o = b.m.sec.US[sid as SectorId];
    const hb = b.out.playerAgent.US[sid as SectorId] ?? 0;
    const ha = a.out.playerAgent.US[sid as SectorId] ?? 0;
    console.log(`  ${sid.padEnd(6)} agentK ${o.agentK[pi].toFixed(4)} → ${m.agentK[pi].toFixed(4)}   $/agent-h ${o.agentPrices[pi].toFixed(2)} → ${m.agentPrices[pi].toFixed(2)}   agent-h ${(hb / 1e6).toFixed(1)}M → ${(ha / 1e6).toFixed(1)}M`);
  }
  const tot = (x: ReturnType<typeof rev>) => x.out.deps.reduce((p, d) => ({ dem: p.dem + (d.agentDemand ?? 0), h: p.h + (d.agentHours ?? 0) }), { dem: 0, h: 0 });
  const tb = tot(b);
  const ta = tot(a);
  console.log(`  total agent-hour demand (all regions) $${tb.dem.toFixed(3)}B/yr → $${ta.dem.toFixed(3)}B/yr; agent-hours ${(tb.h / 1e6).toFixed(1)}M → ${(ta.h / 1e6).toFixed(1)}M; revenue total $${b.out.total.toFixed(3)}B → $${a.out.total.toFixed(3)}B`);
}

// (c) 30 ticks.
let err = '';
try {
  const s = load();
  for (let i = 0; i < 30; i++) tick(s);
} catch (e) { err = String((e as Error)?.stack ?? e); }
check(!err, '(c) 30 ticks without throwing', err.split('\n').slice(0, 4).join(' | '));

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
